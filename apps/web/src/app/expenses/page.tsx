"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { TagManager } from "@/components/tag-manager";
import { Pagination } from "@/components/pagination";
import { ExportButton } from "@/components/export-button";

const LIMIT = 25;

const DOMAIN_COLORS: Record<string, string> = {
  karting: "#f87171",
  ai: "#4f7df7",
  investment: "#34d399",
  general: "#8888a0",
};

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const expenses = trpc.expenses.list.useQuery({ limit: LIMIT, offset, search: search || undefined });
  const categories = trpc.expenses.categories.useQuery();
  const exportData = trpc.export.expenses.useQuery({});
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => { utils.expenses.list.invalidate(); setShowForm(false); setSelectedTags([]); },
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

  // Group transactions by date
  const grouped = new Map<string, any[]>();
  (expenses.data ?? []).forEach((e: any) => {
    const list = grouped.get(e.date) ?? [];
    list.push(e);
    grouped.set(e.date, list);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Transactions</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData.data} filename="expenses.csv" />
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Search transactions..."
          className="w-full rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Transaction</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "description", label: "Description", type: "text", required: true, placeholder: "What did you spend on?" },
              { name: "amount", label: "Amount", type: "number", required: true, placeholder: "0.00", step: "0.01" },
              { name: "date", label: "Date", type: "date", required: true, defaultValue: new Date().toISOString().split("T")[0] },
              { name: "eventName", label: "Event", type: "text", placeholder: "e.g. Round 3" },
              { name: "trackName", label: "Track", type: "text", placeholder: "e.g. NJMP" },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>{field.label}</label>
                <input
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  placeholder={field.placeholder}
                  step={field.step}
                  defaultValue={field.defaultValue}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Category</label>
              <select name="categoryId" className="w-full rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">Uncategorized</option>
                {categories.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Notes</label>
            <textarea name="notes" rows={2} className="w-full rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <TagManager selectedTagIds={selectedTags} onChange={setSelectedTags} />
          <button
            type="submit"
            disabled={createExpense.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--accent-green)", color: "#000" }}
          >
            {createExpense.isPending ? "Saving..." : "Save Transaction"}
          </button>
        </form>
      )}

      {/* Transaction List — Grouped by Date */}
      {expenses.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : grouped.size === 0 ? (
        <div className="finance-card flex flex-col items-center py-16">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "var(--bg-input)" }}>
            📋
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No transactions yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Click &quot;+ Add&quot; to record your first expense</p>
        </div>
      ) : (
        <div className="space-y-1">
          {[...grouped.entries()].map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-medium px-1 py-2 sticky top-0 z-10" style={{ color: "var(--text-muted)", background: "var(--bg-primary)" }}>
                {formatDate(date)}
              </p>
              <div className="finance-card !p-0 overflow-hidden">
                {items.map((expense: any) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 px-4 py-3.5 group"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm flex-shrink-0 font-medium"
                      style={{
                        background: (DOMAIN_COLORS[expense.category?.domain ?? "general"] ?? "#555") + "18",
                        color: DOMAIN_COLORS[expense.category?.domain ?? "general"] ?? "#555",
                      }}
                    >
                      {expense.description.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {expense.category?.name ?? "Uncategorized"}
                        </span>
                        {expense.eventName && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                            {expense.eventName}
                          </span>
                        )}
                        {expense.expenseTags?.map((et: any) => (
                          <span key={et.tag.id} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
                            {et.tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold mono" style={{ color: "var(--accent-red)" }}>
                        −{formatCurrency(expense.amount)}
                      </p>
                      <button
                        onClick={() => deleteExpense.mutate({ id: expense.id })}
                        className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Pagination
            offset={offset}
            limit={LIMIT}
            hasMore={(expenses.data?.length ?? 0) >= LIMIT}
            onPrev={() => setOffset(Math.max(0, offset - LIMIT))}
            onNext={() => setOffset(offset + LIMIT)}
          />
        </div>
      )}
    </div>
  );
}
