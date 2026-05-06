"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";

type Frequency = "monthly" | "per-day" | "per-session";

type Component = {
  id: string;
  name: string;
  amount: number;
  perUnit: number;
  frequency: Frequency;
  notes?: string;
};

type Model = {
  components: Component[];
  assumptions: { sessionsPerDay: number; daysPerMonth: number };
};

const FREQ_LABEL: Record<Frequency, string> = {
  "monthly": "every month(s)",
  "per-day": "every day(s)",
  "per-session": "every session(s)",
};

export function BudgetCard() {
  const projection = trpc.karting.projection.useQuery({});
  const budget = trpc.karting.getBudget.useQuery();
  const utils = trpc.useUtils();
  const setBudget = trpc.karting.setBudget.useMutation({
    onSuccess: () => {
      utils.karting.projection.invalidate();
      utils.karting.getBudget.invalidate();
      setEditing(false);
      setFlash("Saved");
      setTimeout(() => setFlash(null), 2000);
    },
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Model | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (budget.data && !editing) setDraft(budget.data as Model);
  }, [budget.data, editing]);

  if (projection.isLoading || !projection.data) {
    return (
      <div className="finance-card animate-pulse">
        <div className="h-5 w-48 rounded" style={{ background: "var(--bg-input)" }} />
        <div className="h-32 rounded mt-4" style={{ background: "var(--bg-input)" }} />
      </div>
    );
  }

  const p = projection.data;
  const a = p.modelAssumptions;
  const overBy = p.delta.modelVsPaced;
  const overTone = overBy > 0 ? "var(--accent-red)" : "var(--accent-green)";
  const overLabel = overBy > 0 ? "over" : "under";

  return (
    <div className="space-y-4">
      <div className="finance-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Karting budget
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {a.sessionsPerDay} sessions/day · {a.daysPerMonth} days/month ={" "}
              {a.sessionsPerMonth} sessions/month
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
            >
              Edit
            </button>
          )}
          {flash && (
            <span className="text-xs" style={{ color: "var(--accent-green)" }}>
              {flash}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Metric label="Projected / month" value={formatCurrency(p.projectedMonthly, "CNY")} />
          <Metric
            label={`Actual MTD (day ${p.actuals.daysSoFar} of ${p.actuals.daysInMonth})`}
            value={formatCurrency(p.actuals.totalCNY, "CNY")}
          />
          <Metric
            label="Paced end-of-month"
            value={formatCurrency(p.actuals.pacedEndOfMonth, "CNY")}
            sub={
              <span style={{ color: overTone }}>
                {formatCurrency(Math.abs(overBy), "CNY")} {overLabel} budget
              </span>
            }
          />
        </div>

        {/* Breakdown table */}
        <div className="mt-5 overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-3 py-2 text-left text-xs" style={{ color: "var(--text-muted)" }}>Component</th>
                <th className="px-3 py-2 text-right text-xs" style={{ color: "var(--text-muted)" }}>Unit cost</th>
                <th className="px-3 py-2 text-right text-xs" style={{ color: "var(--text-muted)" }}>Cadence</th>
                <th className="px-3 py-2 text-right text-xs" style={{ color: "var(--text-muted)" }}>Monthly</th>
              </tr>
            </thead>
            <tbody>
              {p.breakdown.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text-primary)" }}>
                    {c.name}
                    {c.notes && (
                      <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                        {c.notes}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right mono" style={{ color: "var(--text-secondary)" }}>
                    {formatCurrency(c.unitCost, "CNY")}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right" style={{ color: "var(--text-muted)" }}>
                    1 / {c.perUnit} {c.frequency.replace("per-", "")}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right mono font-medium" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(c.monthlyProjection, "CNY")}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "var(--bg-input)" }}>
                <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Total</td>
                <td colSpan={2} />
                <td className="px-3 py-2.5 text-sm text-right mono font-semibold" style={{ color: "var(--accent-blue)" }}>
                  {formatCurrency(p.projectedMonthly, "CNY")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Per-session economics */}
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Implied cost per session:{" "}
          <span className="mono" style={{ color: "var(--text-secondary)" }}>
            {formatCurrency(p.projectedMonthly / a.sessionsPerMonth, "CNY")}
          </span>
          {" · "}per day:{" "}
          <span className="mono" style={{ color: "var(--text-secondary)" }}>
            {formatCurrency(p.projectedMonthly / a.daysPerMonth, "CNY")}
          </span>
        </p>

        {/* Actuals breakdown */}
        {p.actuals.byCategory.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs cursor-pointer select-none" style={{ color: "var(--text-muted)" }}>
              Show actual {p.actuals.monthStart.slice(0, 7)} spending by category
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {p.actuals.byCategory.map((row) => (
                <div key={row.name ?? "uncat"} className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>{row.name ?? "—"}</span>
                  <span className="mono" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(row.total ?? 0, "CNY")}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {editing && draft && (
        <BudgetEditor
          draft={draft}
          setDraft={setDraft}
          onSave={() => setBudget.mutate(draft)}
          onCancel={() => {
            setEditing(false);
            if (budget.data) setDraft(budget.data as Model);
          }}
          saving={setBudget.isPending}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="balance-md mt-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function BudgetEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: Model;
  setDraft: (m: Model) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const updateComp = (i: number, patch: Partial<Component>) => {
    const next = [...draft.components];
    next[i] = { ...next[i], ...patch };
    setDraft({ ...draft, components: next });
  };
  const addComp = () =>
    setDraft({
      ...draft,
      components: [
        ...draft.components,
        {
          id: `c${Date.now()}`,
          name: "New cost",
          amount: 0,
          perUnit: 1,
          frequency: "monthly",
        },
      ],
    });
  const removeComp = (i: number) =>
    setDraft({ ...draft, components: draft.components.filter((_, j) => j !== i) });

  return (
    <div className="finance-card">
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Edit cost model
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <NumField
          label="Sessions per day"
          value={draft.assumptions.sessionsPerDay}
          onChange={(v) =>
            setDraft({ ...draft, assumptions: { ...draft.assumptions, sessionsPerDay: v } })
          }
        />
        <NumField
          label="Days per month"
          value={draft.assumptions.daysPerMonth}
          onChange={(v) =>
            setDraft({ ...draft, assumptions: { ...draft.assumptions, daysPerMonth: v } })
          }
        />
      </div>

      <div className="space-y-3">
        {draft.components.map((c, i) => (
          <div key={c.id} className="grid grid-cols-12 gap-2 items-start">
            <input
              className="col-span-3 rounded-lg px-2 py-1.5 text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              value={c.name}
              onChange={(e) => updateComp(i, { name: e.target.value })}
              placeholder="Name"
            />
            <input
              type="number"
              className="col-span-2 rounded-lg px-2 py-1.5 text-sm mono"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              value={c.amount}
              onChange={(e) => updateComp(i, { amount: Number(e.target.value) })}
              placeholder="¥"
            />
            <input
              type="number"
              step="0.5"
              className="col-span-1 rounded-lg px-2 py-1.5 text-sm mono"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              value={c.perUnit}
              onChange={(e) => updateComp(i, { perUnit: Number(e.target.value) })}
              title="Amount covers this many units"
            />
            <select
              className="col-span-2 rounded-lg px-2 py-1.5 text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              value={c.frequency}
              onChange={(e) => updateComp(i, { frequency: e.target.value as Frequency })}
            >
              <option value="monthly">months</option>
              <option value="per-day">days</option>
              <option value="per-session">sessions</option>
            </select>
            <input
              className="col-span-3 rounded-lg px-2 py-1.5 text-xs"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              value={c.notes ?? ""}
              onChange={(e) => updateComp(i, { notes: e.target.value })}
              placeholder="notes"
            />
            <button
              onClick={() => removeComp(i)}
              className="col-span-1 text-xs"
              style={{ color: "var(--accent-red)" }}
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4 items-center">
        <button onClick={addComp} className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}>
          + Add component
        </button>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--accent-blue)", color: "#fff" }}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        Cadence column reads "1 every N units". So fuel ¥400 / 6.5 sessions = pick "sessions" with
        amount 400 and per-unit 6.5.
      </p>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm mono"
        style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
      />
    </label>
  );
}
