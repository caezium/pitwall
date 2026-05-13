"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { TagManager } from "@/components/tag-manager";
import { Pagination } from "@/components/pagination";
import { ExportButton } from "@/components/export-button";
import { SectionTitle } from "@/components/ui/section-title";
import { Search, Plus, Trash2, X } from "lucide-react";

const LIMIT = 25;

const DOMAIN_META: Record<string, { color: string; chip: "red" | "blue" | "green" | "purple" }> = {
  karting:    { color: "#ff5252", chip: "red" },
  ai:         { color: "#5b8dff", chip: "blue" },
  investment: { color: "#2ee59d", chip: "green" },
  general:    { color: "#b48cff", chip: "purple" },
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  eventName: string | null;
  trackName: string | null;
  category: { id: string; name: string; domain: string } | null;
  expenseTags?: Array<{ tag: { id: string; name: string } }>;
};

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const expensesQ = trpc.expenses.list.useQuery({ limit: LIMIT, offset, search: search || undefined });
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

  const items = (expensesQ.data ?? []) as Expense[];
  // Group by date
  const grouped = new Map<string, Expense[]>();
  items.forEach((e) => {
    const list = grouped.get(e.date) ?? [];
    list.push(e);
    grouped.set(e.date, list);
  });

  const pageTotal = items.reduce((s, e) => s + e.amount, 0);
  const pageCurrency = items[0]?.currency ?? "CNY";

  return (
    <div className="space-y-5">
      {/* Action row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Search description, notes, category…"
              className="rounded-[12px] pl-9 pr-3 py-2 text-[13px] w-[340px] max-w-full"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setOffset(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {items.length > 0 && (
            <span className="pill pill-mute">
              {items.length} on page · {formatCurrency(pageTotal, pageCurrency)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ExportButton data={exportData.data} filename="expenses.csv" />
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`btn ${showForm ? "btn-secondary" : "btn-primary"}`}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Cancel" : "New"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <SectionTitle eyebrow="New entry" title="Add transaction" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "description", label: "Description", type: "text", required: true, placeholder: "e.g. 极速赛车 trackday" },
              { name: "amount",      label: "Amount",      type: "number", required: true, placeholder: "0.00", step: "0.01" },
              { name: "date",        label: "Date",        type: "date", required: true, defaultValue: new Date().toISOString().split("T")[0] },
              { name: "eventName",   label: "Event",       type: "text", placeholder: "optional" },
              { name: "trackName",   label: "Track",       type: "text", placeholder: "optional" },
            ].map((field) => (
              <div key={field.name}>
                <label className="eyebrow mb-1.5 block">{field.label}</label>
                <input
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  placeholder={field.placeholder}
                  step={field.step}
                  defaultValue={field.defaultValue}
                  className="w-full rounded-[12px] px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            ))}
            <div>
              <label className="eyebrow mb-1.5 block">Category</label>
              <select
                name="categoryId"
                className="w-full rounded-[12px] px-3 py-2.5 text-sm"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">Uncategorized</option>
                {(categories.data as Array<{ id: string; name: string; domain: string }> | undefined)?.map((c) => (
                  <option key={c.id} value={c.id}>{c.domain}/{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-[12px] px-3 py-2.5 text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <TagManager selectedTagIds={selectedTags} onChange={setSelectedTags} />
          <div className="flex justify-end">
            <button type="submit" disabled={createExpense.isPending} className="btn btn-success">
              {createExpense.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {expensesQ.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      ) : grouped.size === 0 ? (
        <div className="finance-card flex flex-col items-center text-center py-16">
          <Search size={28} style={{ color: "var(--text-muted)" }} />
          <p className="text-sm mt-3" style={{ color: "var(--text-primary)" }}>
            {search ? "Nothing matches that search." : "No transactions yet."}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            {search ? "Try a shorter term or clear the box." : "Click New to add one, or use Import."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([date, list]) => {
            const dayTotal = list.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={date} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="eyebrow">{formatDate(date)}</p>
                  <p className="mono text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    {list.length} · {formatCurrency(dayTotal, list[0]?.currency ?? "CNY")}
                  </p>
                </div>
                <div className="finance-card !p-0 overflow-hidden">
                  {list.map((expense, idx) => {
                    const meta = DOMAIN_META[expense.category?.domain ?? "general"] ?? DOMAIN_META.general;
                    return (
                      <div
                        key={expense.id}
                        className="flex items-center gap-3 px-4 py-3 group hover:bg-white/[0.015]"
                        style={{ borderBottom: idx < list.length - 1 ? "1px solid var(--border)" : "none" }}
                      >
                        <div
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                          style={{
                            background: meta.color + "1f",
                            color: meta.color,
                          }}
                        >
                          {(expense.category?.name ?? expense.description).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {expense.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className="pill !text-[10px]"
                              style={{
                                background: meta.color + "1a",
                                color: meta.color,
                              }}
                            >
                              {expense.category?.name ?? "Uncategorized"}
                            </span>
                            {expense.eventName && (
                              <span className="pill pill-info !text-[10px]">{expense.eventName}</span>
                            )}
                            {expense.expenseTags?.map((et) => (
                              <span key={et.tag.id} className="pill pill-mute !text-[10px]">{et.tag.name}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="mono text-[13.5px] font-semibold" style={{ color: "var(--accent-red)" }}>
                            −{formatCurrency(expense.amount, expense.currency ?? "CNY")}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteExpense.mutate({ id: expense.id })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md"
                          style={{ color: "var(--text-muted)" }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <Pagination
            offset={offset}
            limit={LIMIT}
            hasMore={items.length >= LIMIT}
            onPrev={() => setOffset(Math.max(0, offset - LIMIT))}
            onNext={() => setOffset(offset + LIMIT)}
          />
        </div>
      )}
    </div>
  );
}
