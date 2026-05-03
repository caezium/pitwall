"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { CardSkeleton } from "@/components/skeleton";
import { QueryError } from "@/components/error-boundary";

export default function SubscriptionsPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const subs = trpc.subscriptions.list.useQuery();
  const summary = trpc.subscriptions.summary.useQuery();
  const create = trpc.subscriptions.create.useMutation({
    onSuccess: () => { utils.subscriptions.list.invalidate(); utils.subscriptions.summary.invalidate(); setShowForm(false); },
  });
  const del = trpc.subscriptions.delete.useMutation({
    onSuccess: () => { utils.subscriptions.list.invalidate(); utils.subscriptions.summary.invalidate(); },
  });
  const toggle = trpc.subscriptions.update.useMutation({
    onSuccess: () => { utils.subscriptions.list.invalidate(); utils.subscriptions.summary.invalidate(); },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate({
      name: form.get("name") as string,
      provider: form.get("provider") as string,
      type: form.get("type") as "subscription" | "credits" | "prepaid",
      amount: Number(form.get("amount")),
      frequency: form.get("frequency") as "monthly" | "yearly" | "one-time",
      startDate: form.get("startDate") as string,
      notes: (form.get("notes") as string) || undefined,
    });
  };

  if (subs.isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
      </div>
    );
  }
  if (subs.error) return <QueryError error={subs.error} onRetry={() => subs.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>AI Subscriptions</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--accent-blue)", color: "#fff" }}
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="finance-card">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Monthly Equivalent</p>
          <p className="balance-lg mt-2" style={{ color: "var(--accent-blue)" }}>{formatCurrency(summary.data?.monthlyEquivalent ?? 0)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{summary.data?.activeSubs ?? 0} active</p>
        </div>
        {summary.data?.byProvider.map((p: any) => (
          <div key={p.provider} className="finance-card">
            <p className="text-xs font-medium uppercase tracking-wide capitalize" style={{ color: "var(--text-muted)" }}>{p.provider}</p>
            <p className="balance-md mt-2" style={{ color: "var(--text-primary)" }}>
              {formatCurrency(p.monthly)}<span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/mo</span>
            </p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Subscription</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Claude Pro, ChatGPT Plus" },
              { name: "amount", label: "Amount ($)", type: "number", required: true, step: "0.01" },
              { name: "startDate", label: "Start Date", type: "date", required: true, defaultValue: new Date().toISOString().split("T")[0] },
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
            {[
              { name: "provider", label: "Provider", options: [{ v: "anthropic", l: "Anthropic" }, { v: "openai", l: "OpenAI" }, { v: "openrouter", l: "OpenRouter" }, { v: "google", l: "Google" }, { v: "other", l: "Other" }] },
              { name: "type", label: "Type", options: [{ v: "subscription", l: "Subscription (recurring)" }, { v: "credits", l: "Credits (top-up)" }, { v: "prepaid", l: "Prepaid (one-time)" }] },
              { name: "frequency", label: "Frequency", options: [{ v: "monthly", l: "Monthly" }, { v: "yearly", l: "Yearly" }, { v: "one-time", l: "One-time" }] },
            ].map((sel) => (
              <div key={sel.name}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>{sel.label}</label>
                <select
                  name={sel.name}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  {sel.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Notes</label>
            <input
              name="notes"
              placeholder="Optional notes"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent-green)", color: "#000" }}
          >
            {create.isPending ? "Saving..." : "Add Subscription"}
          </button>
        </form>
      )}

      {/* Subscription List */}
      <div className="finance-card !p-0 overflow-hidden">
        {subs.data?.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: "var(--bg-input)" }}>
              🔄
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No subscriptions yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add your Claude Pro, ChatGPT Plus, OpenRouter credits, etc.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Provider</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Frequency</th>
                <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amount</th>
                <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {subs.data?.map((sub: any) => (
                <tr key={sub.id} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-5 py-3.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{sub.name}</td>
                  <td className="px-5 py-3.5 text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{sub.provider}</td>
                  <td className="px-5 py-3.5 text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{sub.type}</td>
                  <td className="px-5 py-3.5 text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{sub.frequency}</td>
                  <td className="px-5 py-3.5 text-sm text-right mono font-medium" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(sub.amount, sub.currency ?? "USD")}{sub.frequency === "monthly" ? "/mo" : sub.frequency === "yearly" ? "/yr" : ""}
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    <button
                      onClick={() => toggle.mutate({ id: sub.id, active: !sub.active })}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-medium"
                      style={{
                        background: sub.active ? "rgba(52, 211, 153, 0.15)" : "var(--bg-input)",
                        color: sub.active ? "var(--accent-green)" : "var(--text-muted)",
                      }}
                    >
                      {sub.active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => del.mutate({ id: sub.id })}
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
        )}
      </div>
    </div>
  );
}
