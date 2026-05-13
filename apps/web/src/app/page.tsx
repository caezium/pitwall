"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@pitwall/shared";
import { BudgetAlerts } from "@/components/budget-alerts";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionTitle } from "@/components/ui/section-title";
import { LwcAreaChart } from "@/components/ui/lwc-area-chart";
import {
  Wallet, Cpu, LineChart as LineChartIcon, Flag,
  ArrowUpRight, ArrowDownRight, Plus, TrendingUp,
} from "lucide-react";

const DOMAIN_META: Record<string, { label: string; color: string; chip: "red" | "blue" | "green" | "yellow" | "purple" | "pink" }> = {
  karting:    { label: "Karting",    color: "var(--accent-red)",    chip: "red" },
  ai:         { label: "AI",         color: "var(--accent-cobalt)", chip: "blue" },
  investment: { label: "Investments",color: "var(--accent-green)",  chip: "green" },
  general:    { label: "Living",     color: "var(--accent-purple)", chip: "purple" },
};

export default function DashboardPage() {
  const overview = trpc.dashboard.overview.useQuery();
  const snapshots = trpc.investments.snapshot.useQuery();
  const kartingProj = trpc.karting.projection.useQuery({});
  const [activityRef] = useAutoAnimate<HTMLDivElement>();

  if (overview.isLoading) {
    return <DashboardSkeleton />;
  }
  if (overview.error || !overview.data) return null;
  const data = overview.data;

  const pieData = (data.domainBreakdown as Array<{ domain: string | null; total: number }>)
    .filter((d) => (d.total ?? 0) > 0)
    .map((d) => ({ name: d.domain ?? "general", value: d.total ?? 0 }));
  const totalSpent = pieData.reduce((s: number, d: { value: number }) => s + d.value, 0);

  // Portfolio history (lightweight-charts series)
  const histRaw = ((snapshots.data ?? []) as Array<{ date: string; netLiquidation: number }>).slice().reverse();
  const navSeries = histRaw.map((s) => ({ time: s.date, value: s.netLiquidation }));
  const navLast = navSeries.length > 0 ? navSeries[navSeries.length - 1].value : data.portfolio?.netLiquidation ?? 0;
  const navFirst = navSeries.length > 0 ? navSeries[0].value : navLast;
  const navDelta = navLast - navFirst;
  const navDeltaPct = navFirst > 0 ? (navDelta / navFirst) * 100 : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      {/* ============ Main column ============ */}
      <div className="space-y-5 min-w-0">
        <BudgetAlerts />

        {/* Hero KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Last 30 days spent"
            value={formatCurrency(data.monthlyBurn, "CNY")}
            sub={`${data.monthlyTransactions} transactions · since ${data.windowStart}`}
            icon={Wallet}
            iconColor="red"
            glow
          />
          <MetricCard
            label="AI tokens MTD"
            value={formatCurrency(data.aiCostsMtd, "USD")}
            sub={`+ ${formatCurrency(data.subscriptionMonthly ?? 0, "USD")}/mo in subscriptions`}
            icon={Cpu}
            iconColor="blue"
            action={{ label: "Sync", onClick: () => location.assign("/ai-costs") }}
          />
          <MetricCard
            label="Portfolio (NetLiq)"
            value={data.portfolio ? formatCurrency(data.portfolio.netLiquidation, "USD") : "—"}
            sub={
              data.portfolio
                ? `${navDelta >= 0 ? "+" : ""}${formatCurrency(navDelta, "USD")} (${navDeltaPct >= 0 ? "+" : ""}${navDeltaPct.toFixed(2)}%) over series`
                : "no IBKR snapshot yet"
            }
            icon={LineChartIcon}
            iconColor="green"
            pill={
              data.portfolio
                ? { tone: navDelta >= 0 ? "pos" : "neg", text: `${navDelta >= 0 ? "↗" : "↘"} ${navDeltaPct.toFixed(2)}%` }
                : undefined
            }
          />
        </div>

        {/* Portfolio history (lightweight-charts) */}
        <div className="finance-card">
          <SectionTitle
            eyebrow="Portfolio"
            title={
              <span className="flex items-center gap-2">
                Net liquidation
                <span className="balance-md mono" style={{ color: "var(--text-secondary)" }}>
                  {data.portfolio ? formatCurrency(data.portfolio.netLiquidation, "USD") : "—"}
                </span>
              </span>
            }
            right={
              <span className={`pill ${navDelta >= 0 ? "pill-pos" : "pill-neg"}`}>
                {navDelta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {navDeltaPct.toFixed(2)}%
              </span>
            }
          />
          {navSeries.length > 1 ? (
            <LwcAreaChart
              data={navSeries}
              height={240}
              topColor="rgba(46, 229, 157, 0.30)"
              bottomColor="rgba(46, 229, 157, 0.0)"
              lineColor="#2ee59d"
            />
          ) : (
            <EmptyChart
              hint="Run another Flex Query import in a few days to start a history line."
              cta={{ label: "Import IBKR Flex", href: "/investments" }}
            />
          )}
        </div>

        {/* Spending breakdown + recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Stacked breakdown bar */}
          <div className="finance-card lg:col-span-2">
            <SectionTitle eyebrow="30-day mix" title="Where it's going" />
            {pieData.length > 0 ? (
              <>
                <div className="flex w-full h-3 rounded-full overflow-hidden">
                  {pieData.map((d: { name: string; value: number }) => (
                    <div
                      key={d.name}
                      style={{
                        background: DOMAIN_META[d.name]?.color ?? "#666",
                        width: `${(d.value / totalSpent) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {pieData
                    .sort((a: { value: number }, b: { value: number }) => b.value - a.value)
                    .map((d: { name: string; value: number }) => (
                      <li key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ background: DOMAIN_META[d.name]?.color ?? "#666" }}
                          />
                          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                            {DOMAIN_META[d.name]?.label ?? d.name}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {((d.value / totalSpent) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <span className="mono text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          {formatCurrency(d.value, "CNY")}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
                No spending in the last 30 days.
              </p>
            )}
          </div>

          {/* Recent activity */}
          <div className="finance-card lg:col-span-3 !p-0">
            <div className="flex items-center justify-between p-5 pb-3">
              <SectionTitle eyebrow="Latest" title="Recent activity" />
              <a href="/expenses" className="text-[12px] font-medium" style={{ color: "var(--accent-red)" }}>
                View all →
              </a>
            </div>
            {data.recentExpenses.length === 0 ? (
              <EmptyState
                icon={<Plus size={20} />}
                title="No transactions yet"
                hint="Import a WeChat XLSX, paste a CSV, or use Quick Entry."
                cta={{ label: "Add expense", href: "/quick-entry" }}
              />
            ) : (
              <div ref={activityRef} className="px-5 pb-2">
                {(data.recentExpenses as Array<{ id: string; description: string; amount: number; currency: string; date: string; category: { name: string; domain: string } | null }>).map((expense) => {
                  const domain = expense.category?.domain ?? "general";
                  const meta = DOMAIN_META[domain];
                  return (
                    <div key={expense.id} className="tx-row">
                      <div
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 text-[13px] font-semibold"
                        style={{
                          background: (meta?.color ?? "#666") + "1f",
                          color: meta?.color ?? "#aaa",
                        }}
                      >
                        {(expense.category?.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {expense.description}
                        </p>
                        <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {expense.category?.name ?? "Uncategorized"} · {expense.date}
                        </p>
                      </div>
                      <span className="mono text-[13.5px] font-semibold" style={{ color: "var(--accent-red)" }}>
                        −{formatCurrency(expense.amount, expense.currency ?? "CNY")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ Right rail ============ */}
      <div className="space-y-5 min-w-0">
        {/* Karting projection */}
        {kartingProj.data && (
          <div className="rail-card pitwall-grid">
            <div className="flex items-center gap-2 mb-3">
              <span className="icon-chip icon-chip-red">
                <Flag size={16} />
              </span>
              <div>
                <p className="eyebrow !text-[10px]">Karting budget</p>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {kartingProj.data.modelAssumptions.sessionsPerMonth} sessions / month
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <RailKpi
                label="Projected"
                value={formatCurrency(kartingProj.data.projectedMonthly, "CNY")}
                tone="default"
              />
              <RailKpi
                label="Actual MTD"
                value={formatCurrency(kartingProj.data.actuals.totalCNY, "CNY")}
                tone="default"
              />
            </div>

            <RailProgress
              value={kartingProj.data.actuals.totalCNY}
              max={kartingProj.data.projectedMonthly}
            />

            <p className="text-[11.5px] mt-3" style={{ color: "var(--text-muted)" }}>
              Pace ⟶{" "}
              <span className="mono" style={{ color: "var(--text-secondary)" }}>
                {formatCurrency(kartingProj.data.actuals.pacedEndOfMonth, "CNY")}
              </span>{" "}
              EOM
              {kartingProj.data.delta.modelVsPaced > 0 ? (
                <span className="pill pill-neg ml-2">
                  +{formatCurrency(kartingProj.data.delta.modelVsPaced, "CNY")} over
                </span>
              ) : (
                <span className="pill pill-pos ml-2">
                  {formatCurrency(Math.abs(kartingProj.data.delta.modelVsPaced), "CNY")} under
                </span>
              )}
            </p>

            <a
              href="/karting"
              className="btn btn-secondary w-full justify-center mt-4 !text-[12px]"
            >
              Open karting hub →
            </a>
          </div>
        )}

        {/* Quick links — AI subs */}
        <div className="rail-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="icon-chip icon-chip-blue">
              <Cpu size={16} />
            </span>
            <div>
              <p className="eyebrow !text-[10px]">AI</p>
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {data.activeSubsCount ?? 0} active subscriptions
              </p>
            </div>
          </div>
          <p className="balance-lg" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(data.subscriptionMonthly ?? 0, "USD")}
          </p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            recurring monthly
          </p>
          <p className="text-[11.5px] mt-3" style={{ color: "var(--text-muted)" }}>
            plus{" "}
            <span className="mono" style={{ color: "var(--text-secondary)" }}>
              {formatCurrency(data.aiCostsMtd, "USD")}
            </span>{" "}
            in token usage this window
          </p>
          <div className="flex gap-2 mt-4">
            <a href="/ai-costs" className="btn btn-secondary flex-1 justify-center !text-[12px]">
              Usage
            </a>
            <a href="/subscriptions" className="btn btn-secondary flex-1 justify-center !text-[12px]">
              Subs
            </a>
          </div>
        </div>

        {/* Trend tip */}
        <div className="rail-card">
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-chip icon-chip-green">
              <TrendingUp size={16} />
            </span>
            <p className="eyebrow !text-[10px]">Tip</p>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Re-run <span className="mono" style={{ color: "var(--accent-red)" }}>tokscale</span> daily
            and import a fresh IBKR Flex Query every Sunday — Pitwall stitches them into
            ai_usage_records and portfolio_snapshots automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ===================== helpers ===================== */

function RailKpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div>
      <p className="eyebrow !text-[10px]">{label}</p>
      <p
        className="balance-md mt-1"
        style={{
          color: tone === "warn" ? "var(--accent-yellow)" : "var(--text-primary)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function RailProgress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max;
  return (
    <div className="mt-4">
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: "var(--bg-input)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: over
              ? "linear-gradient(90deg, #ff3838 0%, #ffd23f 100%)"
              : "linear-gradient(90deg, #2ee59d 0%, #5b8dff 100%)",
            transition: "width 600ms ease",
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>{pct.toFixed(0)}% of plan</span>
        <span className="mono">{value > max ? "over" : "on track"}</span>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
        {icon}
      </div>
      <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      <p className="text-[12px] mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>
        {hint}
      </p>
      {cta && (
        <a href={cta.href} className="btn btn-primary mt-4 !text-[12px]">
          {cta.label}
        </a>
      )}
    </div>
  );
}

function EmptyChart({ hint, cta }: { hint: string; cta?: { label: string; href: string } }) {
  return (
    <div
      className="rounded-[12px] flex flex-col items-center justify-center text-center px-6"
      style={{
        height: 240,
        border: "1px dashed var(--border)",
        background: "var(--bg-input)",
      }}
    >
      <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Not enough history yet.
      </p>
      <p className="text-[12px] mt-1 max-w-md" style={{ color: "var(--text-muted)" }}>
        {hint}
      </p>
      {cta && (
        <a href={cta.href} className="btn btn-secondary mt-3 !text-[12px]">
          {cta.label} →
        </a>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 animate-pulse">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          ))}
        </div>
        <div className="h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-2 h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
          <div className="col-span-3 h-72 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        </div>
      </div>
      <div className="space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-2xl" style={{ background: "var(--bg-card)" }} />
        ))}
      </div>
    </div>
  );
}
