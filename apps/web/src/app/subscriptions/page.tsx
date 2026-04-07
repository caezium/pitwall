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

  if (subs.isLoading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  if (subs.error) return <QueryError error={subs.error} onRetry={() => subs.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AI Subscriptions</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">
          {showForm ? "Cancel" : "Add Subscription"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Monthly Equivalent</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(summary.data?.monthlyEquivalent ?? 0)}</p>
          <p className="text-xs text-zinc-500 mt-1">{summary.data?.activeSubs ?? 0} active</p>
        </div>
        {summary.data?.byProvider.map((p: any) => (
          <div key={p.provider} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-sm text-zinc-400 capitalize">{p.provider}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(p.monthly)}/mo</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name</label>
              <input name="name" required placeholder="e.g. Claude Pro, ChatGPT Plus" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Provider</label>
              <select name="provider" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="google">Google</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Type</label>
              <select name="type" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="subscription">Subscription (recurring)</option>
                <option value="credits">Credits (top-up)</option>
                <option value="prepaid">Prepaid (one-time)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Amount ($)</label>
              <input name="amount" type="number" step="0.01" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Frequency</label>
              <select name="frequency" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Start Date</label>
              <input name="startDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <input name="notes" placeholder="Optional notes" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={create.isPending} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50">
            {create.isPending ? "Saving..." : "Add Subscription"}
          </button>
        </form>
      )}

      {/* Subscription List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {subs.data?.length === 0 ? (
          <p className="p-6 text-zinc-500 text-sm">No subscriptions yet. Add your Claude Pro, ChatGPT Plus, OpenRouter credits, etc.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {subs.data?.map((sub: any) => (
                <tr key={sub.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-sm font-medium">{sub.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 capitalize">{sub.provider}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 capitalize">{sub.type}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 capitalize">{sub.frequency}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(sub.amount)}{sub.frequency === "monthly" ? "/mo" : sub.frequency === "yearly" ? "/yr" : ""}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => toggle.mutate({ id: sub.id, active: !sub.active })}
                      className={`px-2 py-0.5 rounded text-xs ${sub.active ? "bg-green-900/50 text-green-400" : "bg-zinc-800 text-zinc-500"}`}
                    >
                      {sub.active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del.mutate({ id: sub.id })} className="text-xs text-zinc-600 hover:text-red-400">Delete</button>
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
