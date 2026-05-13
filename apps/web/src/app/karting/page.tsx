"use client";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";
import { QueryError } from "@/components/error-boundary";
import { ExportButton } from "@/components/export-button";
import { BudgetCard } from "./budget-card";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionTitle } from "@/components/ui/section-title";
import { LwcAreaChart } from "@/components/ui/lwc-area-chart";
import { Flag, Wrench, Wallet, Trophy, MapPin, Calendar } from "lucide-react";

type Expense = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  eventName: string | null;
  trackName: string | null;
  category: { name: string; domain: string } | null;
};

const CAT_META: Record<string, { color: string; chip: "red" | "yellow" | "green" | "blue" | "purple" | "pink" }> = {
  "Entry Fees":                  { color: "#ff5252", chip: "red" },
  "Tires":                       { color: "#ffd23f", chip: "yellow" },
  "Fuel":                        { color: "#ff7a45", chip: "yellow" },
  "Parts & Maintenance":         { color: "#b48cff", chip: "purple" },
  "Travel":                      { color: "#5b8dff", chip: "blue" },
  "Gear":                        { color: "#2ee59d", chip: "green" },
  "Rentals":                     { color: "#ff7ab6", chip: "pink" },
  "Membership":                  { color: "#ffd23f", chip: "yellow" },
  "Certification":               { color: "#ff7a45", chip: "red" },
  "Race Entry & Certification":  { color: "#ff5252", chip: "red" },
};

export default function KartingPage() {
  const expenses = trpc.expenses.list.useQuery({ domain: "karting" });
  const exportData = trpc.export.expenses.useQuery({});

  if (expenses.isLoading) return <KartingSkeleton />;
  if (expenses.error) return <QueryError error={expenses.error} onRetry={() => expenses.refetch()} />;

  const items = (expenses.data ?? []) as Expense[];
  const totalSpend = items.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const byCategory = new Map<string, number>();
  items.forEach((e) => {
    const name = e.category?.name ?? "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount);
  });
  const categoryRows = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount, pct: totalSpend > 0 ? (amount / totalSpend) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Cumulative spending over time (lightweight-charts)
  const dateSorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));
  const cumulative: { time: string; value: number }[] = [];
  let running = 0;
  for (const e of dateSorted) {
    running += e.amount;
    // collapse to one point per date
    if (cumulative.length > 0 && cumulative[cumulative.length - 1].time === e.date) {
      cumulative[cumulative.length - 1].value = running;
    } else {
      cumulative.push({ time: e.date, value: running });
    }
  }

  // Track-day count (distinct dates in Entry Fees / Travel / Rentals)
  const trackDateSet = new Set<string>();
  items.forEach((e) => {
    if (
      ["Entry Fees", "Rentals", "Travel", "Race Entry & Certification", "Certification"].includes(
        e.category?.name ?? ""
      )
    ) {
      trackDateSet.add(e.date);
    }
  });
  const trackDays = trackDateSet.size;
  const costPerDay = trackDays > 0 ? totalSpend / trackDays : 0;

  // Recent track days (group expenses by date)
  const byDate = new Map<string, { total: number; categories: Set<string>; descriptions: string[] }>();
  items.forEach((e) => {
    const cur = byDate.get(e.date) ?? { total: 0, categories: new Set(), descriptions: [] };
    cur.total += e.amount;
    if (e.category?.name) cur.categories.add(e.category.name);
    cur.descriptions.push(e.description);
    byDate.set(e.date, cur);
  });
  const recentDays = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      {/* ====== Main ====== */}
      <div className="space-y-5 min-w-0">
        <div className="flex items-center justify-end">
          <ExportButton data={exportData.data} filename="karting-expenses.csv" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Total karting"
            value={formatCurrency(totalSpend, "CNY")}
            sub={`${items.length} expenses logged`}
            icon={Flag}
            iconColor="red"
            glow
          />
          <MetricCard
            label="Track days"
            value={`${trackDays}`}
            sub={trackDays > 0 ? `last: ${recentDays[0]?.[0] ?? "—"}` : ""}
            icon={Calendar}
            iconColor="yellow"
          />
          <MetricCard
            label="Cost / day"
            value={formatCurrency(costPerDay, "CNY")}
            sub="implied unit econ"
            icon={Wallet}
            iconColor="green"
          />
          <MetricCard
            label="Biggest category"
            value={categoryRows[0] ? formatCurrency(categoryRows[0].amount, "CNY") : "—"}
            sub={categoryRows[0]?.name ?? ""}
            icon={Trophy}
            iconColor="purple"
          />
        </div>

        {/* Cumulative spend chart */}
        <div className="finance-card">
          <SectionTitle
            eyebrow="Spending curve"
            title={
              <span className="flex items-center gap-2">
                Cumulative karting spend
                <span className="balance-md mono" style={{ color: "var(--text-secondary)" }}>
                  {formatCurrency(totalSpend, "CNY")}
                </span>
              </span>
            }
          />
          {cumulative.length > 1 ? (
            <LwcAreaChart
              data={cumulative}
              height={240}
              topColor="rgba(255, 56, 56, 0.35)"
              bottomColor="rgba(255, 56, 56, 0.0)"
              lineColor="#ff3838"
              priceFormat={(v) => `¥${v.toFixed(0)}`}
            />
          ) : (
            <p className="text-sm py-10 text-center" style={{ color: "var(--text-muted)" }}>
              Need at least two karting expenses to draw a curve.
            </p>
          )}
        </div>

        {/* Budget projection */}
        <BudgetCard />

        {/* Category bar */}
        <div className="finance-card">
          <SectionTitle eyebrow="Spending mix" title="By category" />
          {categoryRows.length > 0 && (
            <div className="flex w-full h-3 rounded-full overflow-hidden mb-4">
              {categoryRows.map((c) => (
                <div
                  key={c.name}
                  style={{
                    background: CAT_META[c.name]?.color ?? "#666",
                    width: `${c.pct}%`,
                  }}
                  title={`${c.name} ${c.pct.toFixed(1)}%`}
                />
              ))}
            </div>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="!text-right">Share</th>
                <th className="!text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((c) => (
                <tr key={c.name}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: CAT_META[c.name]?.color ?? "#666" }}
                      />
                      <span style={{ color: "var(--text-primary)" }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="!text-right mono" style={{ color: "var(--text-muted)" }}>
                    {c.pct.toFixed(1)}%
                  </td>
                  <td className="!text-right mono font-semibold">
                    {formatCurrency(c.amount, "CNY")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent track days */}
        <div className="finance-card !p-0 overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle eyebrow="Calendar" title="Recent track days" />
          </div>
          {recentDays.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-6">
              <Flag size={28} style={{ color: "var(--text-muted)" }} />
              <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>No karting expenses yet</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Categories</th>
                  <th className="!text-right">Day total</th>
                </tr>
              </thead>
              <tbody>
                {recentDays.map(([date, d]) => (
                  <tr key={date}>
                    <td className="mono">{formatDate(date)}</td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[...d.categories].slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="pill"
                            style={{
                              background: (CAT_META[c]?.color ?? "#888") + "1f",
                              color: CAT_META[c]?.color ?? "#aaa",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="!text-right mono font-semibold">
                      {formatCurrency(d.total, "CNY")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ====== Right rail ====== */}
      <div className="space-y-5 min-w-0">
        {/* Latest equipment */}
        <div className="rail-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="icon-chip icon-chip-purple">
              <Wrench size={16} />
            </span>
            <div>
              <p className="eyebrow !text-[10px]">Gear & maintenance</p>
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Latest purchases
              </p>
            </div>
          </div>
          <ul className="space-y-2.5 mt-3">
            {items
              .filter((e) => ["Gear", "Parts & Maintenance"].includes(e.category?.name ?? ""))
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] truncate" style={{ color: "var(--text-primary)" }}>
                      {e.description}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {e.date} · {e.category?.name}
                    </p>
                  </div>
                  <span className="mono text-[12.5px] font-semibold flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                    {formatCurrency(e.amount, e.currency)}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        {/* Track call-out */}
        <div className="rail-card pitwall-grid">
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-chip icon-chip-red">
              <MapPin size={16} />
            </span>
            <p className="eyebrow !text-[10px]">Most-used track</p>
          </div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            极速赛车 · Shenzhen
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            Where most of your trackday entries land.
          </p>
        </div>
      </div>
    </div>
  );
}

function KartingSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 animate-pulse">
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
        <div className="h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        <div className="h-56 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
      <div className="space-y-5">
        <div className="h-56 rounded-2xl" style={{ background: "var(--bg-card)" }} />
      </div>
    </div>
  );
}
