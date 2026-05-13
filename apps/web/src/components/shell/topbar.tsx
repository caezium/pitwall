"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, Settings, RefreshCcw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

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
      className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3.5 border-b border-base-300 bg-base-100/80 backdrop-blur-md"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight truncate text-base-content">
            {meta.title}
          </h1>
          {meta.sub && (
            <p className="text-[11.5px] truncate text-base-content/60">
              {meta.sub}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Search affordance — non-functional, hints at planned ⌘K palette */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12.5px] bg-base-200 border border-base-300 text-base-content/60">
          <Search size={14} />
          <span className="select-none">Search…</span>
          <kbd className="kbd kbd-xs">⌘K</kbd>
        </div>

        <ThemeToggle />

        <button
          className="btn btn-ghost btn-sm btn-square"
          title="Refresh"
          onClick={() => window.location.reload()}
          aria-label="Refresh"
        >
          <RefreshCcw size={16} />
        </button>
        <a
          href="/settings"
          className="btn btn-ghost btn-sm btn-square"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={16} />
        </a>
        <button
          className="btn btn-ghost btn-sm btn-square indicator"
          title="Notifications"
          aria-label="Notifications"
        >
          <span className="indicator-item indicator-top indicator-end badge badge-xs badge-primary"></span>
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
