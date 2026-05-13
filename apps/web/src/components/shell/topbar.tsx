"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, Settings, RefreshCcw } from "lucide-react";

const titles: Record<string, { title: string; sub: string }> = {
  "/":              { title: "Dashboard",     sub: "Everything across karting, AI, and the portfolio at a glance." },
  "/expenses":      { title: "Transactions",  sub: "Search, tag, and recategorize every line item." },
  "/quick-entry":   { title: "Quick Entry",   sub: "Spreadsheet-style bulk add — auto-fills as you type." },
  "/karting":       { title: "Karting",       sub: "Track-day spending, budget, and unit economics." },
  "/budgets":       { title: "Budgets",       sub: "Spend caps with vs-actual progress and forecast." },
  "/recurring":     { title: "Recurring",     sub: "Auto-generated scheduled expenses." },
  "/ai-costs":      { title: "AI Costs",      sub: "Per-day, per-model usage from tokscale + provider APIs." },
  "/subscriptions": { title: "Subscriptions", sub: "Claude Pro, OpenRouter, iCloud — recurring AI bills." },
  "/investments":   { title: "Investments",   sub: "IBKR positions, NetLiq history, trade log." },
  "/import":        { title: "Import CSV",    sub: "Map columns from any export and bulk-import." },
  "/settings":      { title: "Settings",      sub: "API keys, backups, encryption, IBKR gateway." },
};

export function Topbar() {
  const pathname = usePathname();
  const meta = titles[pathname] ?? { title: "Pitwall", sub: "" };

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3.5 border-b backdrop-blur-md"
      style={{
        borderColor: "var(--border)",
        background: "rgba(7, 8, 13, 0.78)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
            {meta.title}
          </h1>
          {meta.sub && (
            <p className="text-[11.5px] truncate" style={{ color: "var(--text-muted)" }}>
              {meta.sub}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12.5px]"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <Search size={14} />
          <span className="select-none">Search…</span>
          <span className="ml-2 px-1.5 py-0.5 rounded mono text-[10px]"
            style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
            ⌘K
          </span>
        </div>

        <button
          className="btn btn-ghost !px-2 !py-2"
          title="Refresh"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw size={16} />
        </button>
        <a href="/settings" className="btn btn-ghost !px-2 !py-2" title="Settings">
          <Settings size={16} />
        </a>
        <button className="btn btn-ghost !px-2 !py-2 relative" title="Notifications">
          <Bell size={16} />
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--accent-red)" }}
          />
        </button>
      </div>
    </header>
  );
}
