"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

type Row = {
  id: string;
  description: string;
  amount: string;
  date: string;
  categoryId: string;
  eventName: string;
  trackName: string;
  notes: string;
  saved: boolean;
};

function emptyRow(): Row {
  return {
    id: crypto.randomUUID(),
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    categoryId: "",
    eventName: "",
    trackName: "",
    notes: "",
    saved: false,
  };
}

export default function QuickEntryPage() {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [lastEvent, setLastEvent] = useState("");
  const [lastTrack, setLastTrack] = useState("");
  const [lastCategory, setLastCategory] = useState("");
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);

  const categories = trpc.expenses.categories.useQuery();
  const utils = trpc.useUtils();
  const createExpense = trpc.expenses.create.useMutation();

  // Auto-focus first empty row's description
  useEffect(() => {
    const firstEmpty = rows.findIndex((r) => !r.saved && !r.description);
    if (firstEmpty >= 0 && descRefs.current[firstEmpty]) {
      descRefs.current[firstEmpty]?.focus();
    }
  }, [rows.length]);

  const updateRow = (index: number, field: keyof Row, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value, saved: false };

      // Auto-fill: remember last used event/track/category for subsequent rows
      if (field === "eventName" && value) setLastEvent(value);
      if (field === "trackName" && value) setLastTrack(value);
      if (field === "categoryId" && value) setLastCategory(value);

      // Auto-add new row when typing in last row
      if (index === next.length - 1 && field === "description" && value) {
        next.push({
          ...emptyRow(),
          eventName: lastEvent,
          trackName: lastTrack,
          categoryId: lastCategory,
        });
      }

      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    // Tab from amount → next row's description
    if (e.key === "Tab" && !e.shiftKey && field === "notes") {
      e.preventDefault();
      const nextIdx = rowIndex + 1;
      if (nextIdx < rows.length) {
        descRefs.current[nextIdx]?.focus();
      }
    }

    // Enter on amount → save row and move to next
    if (e.key === "Enter" && field === "amount") {
      e.preventDefault();
      saveRow(rowIndex);
    }
  };

  const saveRow = async (index: number) => {
    const row = rows[index];
    if (!row.description || !row.amount) return;

    try {
      await createExpense.mutateAsync({
        description: row.description,
        amount: parseFloat(row.amount),
        date: row.date,
        categoryId: row.categoryId || undefined,
        eventName: row.eventName || undefined,
        trackName: row.trackName || undefined,
        notes: row.notes || undefined,
      });

      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], saved: true };
        return next;
      });
    } catch {
      // error handled by UI
    }
  };

  const saveAll = async () => {
    setSaving(true);
    const unsaved = rows.filter((r) => !r.saved && r.description && r.amount);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.saved && r.description && r.amount) {
        await saveRow(i);
      }
    }

    utils.expenses.list.invalidate();
    setSaving(false);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRows = (count: number) => {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => ({
        ...emptyRow(),
        eventName: lastEvent,
        trackName: lastTrack,
        categoryId: lastCategory,
      })),
    ]);
  };

  const unsavedCount = rows.filter((r) => !r.saved && r.description && r.amount).length;
  const savedCount = rows.filter((r) => r.saved).length;
  const totalAmount = rows
    .filter((r) => r.description && r.amount)
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Quick Entry</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Spreadsheet-style bulk expense entry. Tab through fields, Enter to save a row.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">
            {savedCount} saved &middot; {unsavedCount} pending &middot; {formatCurrency(totalAmount)} total
          </span>
          <button
            onClick={saveAll}
            disabled={saving || unsavedCount === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : `Save All (${unsavedCount})`}
          </button>
        </div>
      </div>

      {/* Quick fill bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-4 text-sm">
        <span className="text-zinc-500">Quick fill:</span>
        <div className="flex items-center gap-2">
          <label className="text-zinc-500 text-xs">Date</label>
          <input
            type="date"
            defaultValue={new Date().toISOString().split("T")[0]}
            onChange={(e) => {
              setRows((prev) =>
                prev.map((r) => (r.saved ? r : { ...r, date: e.target.value }))
              );
            }}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-zinc-500 text-xs">Category</label>
          <select
            value={lastCategory}
            onChange={(e) => {
              setLastCategory(e.target.value);
              setRows((prev) =>
                prev.map((r) => (r.saved || r.categoryId ? r : { ...r, categoryId: e.target.value }))
              );
            }}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
          >
            <option value="">--</option>
            {categories.data?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-zinc-500 text-xs">Event</label>
          <input
            value={lastEvent}
            onChange={(e) => setLastEvent(e.target.value)}
            placeholder="Event name"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-zinc-500 text-xs">Track</label>
          <input
            value={lastTrack}
            onChange={(e) => setLastTrack(e.target.value)}
            placeholder="Track"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs w-28"
          />
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2 w-24">Amount</th>
              <th className="px-2 py-2 w-32">Date</th>
              <th className="px-2 py-2 w-32">Category</th>
              <th className="px-2 py-2 w-36">Event</th>
              <th className="px-2 py-2 w-28">Track</th>
              <th className="px-2 py-2 w-36">Notes</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-zinc-800/30 ${
                  row.saved ? "bg-green-950/20" : ""
                }`}
              >
                <td className="px-2 py-1 text-xs text-zinc-600">{i + 1}</td>
                <td className="px-1 py-1">
                  <input
                    ref={(el) => { descRefs.current[i] = el; }}
                    value={row.description}
                    onChange={(e) => updateRow(i, "description", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i, "description")}
                    disabled={row.saved}
                    placeholder="What did you spend on?"
                    className="w-full bg-transparent border-0 px-1 py-1 text-sm focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.amount}
                    onChange={(e) => updateRow(i, "amount", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i, "amount")}
                    disabled={row.saved}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-transparent border-0 px-1 py-1 text-sm font-mono focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.date}
                    onChange={(e) => updateRow(i, "date", e.target.value)}
                    disabled={row.saved}
                    type="date"
                    className="w-full bg-transparent border-0 px-1 py-1 text-xs focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    value={row.categoryId}
                    onChange={(e) => updateRow(i, "categoryId", e.target.value)}
                    disabled={row.saved}
                    className="w-full bg-transparent border-0 px-1 py-1 text-xs focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  >
                    <option value="">--</option>
                    {categories.data?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.eventName}
                    onChange={(e) => updateRow(i, "eventName", e.target.value)}
                    disabled={row.saved}
                    placeholder="Event"
                    className="w-full bg-transparent border-0 px-1 py-1 text-xs focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.trackName}
                    onChange={(e) => updateRow(i, "trackName", e.target.value)}
                    disabled={row.saved}
                    placeholder="Track"
                    className="w-full bg-transparent border-0 px-1 py-1 text-xs focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.notes}
                    onChange={(e) => updateRow(i, "notes", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i, "notes")}
                    disabled={row.saved}
                    placeholder="Notes"
                    className="w-full bg-transparent border-0 px-1 py-1 text-xs focus:outline-none focus:bg-zinc-800/50 rounded disabled:text-zinc-500"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  {row.saved ? (
                    <span className="text-green-500 text-xs">Saved</span>
                  ) : (
                    <button
                      onClick={() => removeRow(i)}
                      className="text-xs text-zinc-600 hover:text-red-400"
                    >
                      x
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={() => addRows(5)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
          + 5 rows
        </button>
        <button onClick={() => addRows(10)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
          + 10 rows
        </button>
      </div>
    </div>
  );
}
