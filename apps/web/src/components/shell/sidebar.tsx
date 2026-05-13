"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, Zap, Flag, Target, Repeat,
  Cpu, Infinity as InfinityIcon, LineChart,
  Download, Settings, LogOut, HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};
type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Money",
    items: [
      { href: "/expenses",    label: "Transactions", icon: ArrowLeftRight },
      { href: "/quick-entry", label: "Quick Entry",  icon: Zap },
      { href: "/budgets",     label: "Budgets",      icon: Target },
      { href: "/recurring",   label: "Recurring",    icon: Repeat },
    ],
  },
  {
    label: "Racing",
    items: [{ href: "/karting", label: "Karting", icon: Flag }],
  },
  {
    label: "AI",
    items: [
      { href: "/ai-costs",      label: "Usage",         icon: Cpu },
      { href: "/subscriptions", label: "Subscriptions", icon: InfinityIcon },
    ],
  },
  {
    label: "Invest",
    items: [{ href: "/investments", label: "Portfolio", icon: LineChart }],
  },
  {
    label: "Tools",
    items: [
      { href: "/import",   label: "Import",   icon: Download },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed] = useState(false);

  return (
    <aside
      className="flex flex-col border-r border-base-300 bg-base-100 select-none"
      style={{ width: collapsed ? 72 : 240 }}
    >
      {/* Brand — keep racing-flavored gradient logo */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center font-bold text-white shadow-lg"
            style={{
              background: "linear-gradient(135deg, #ff3838 0%, #ff7a45 45%, #ffd23f 100%)",
              boxShadow: "0 4px 14px -4px rgba(255, 56, 56, 0.45)",
            }}
          >
            P
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-base-content">
                Pitwall
              </span>
              <span className="text-[10px] text-base-content/50">
                Personal finance HQ
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 overflow-y-auto pb-2">
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            {!collapsed && (
              <div className="flex items-center gap-1 px-3 mb-1.5 mt-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-base-content/50">
                  {g.label}
                </p>
                <div className="flex-1 h-px bg-base-300" />
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={[
                        "relative flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-medium border",
                        active
                          ? "text-base-content bg-base-200 border-base-300"
                          : "text-base-content/70 border-transparent hover:bg-base-200/60 hover:text-base-content",
                      ].join(" ")}
                    >
                      {/* Active indicator — race-flag gradient stripe, theme-agnostic */}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                          style={{
                            background: "linear-gradient(180deg, #ff3838 0%, #ffd23f 100%)",
                          }}
                        />
                      )}
                      <Icon size={16} strokeWidth={2} className="flex-shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && item.badge && (
                        <span className="badge badge-info badge-xs">{item.badge}</span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2.5 pb-4 pt-2 border-t border-base-300">
        <a
          href="https://github.com/caezium/pitwall"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] text-base-content/70 hover:text-base-content hover:bg-base-200/60"
        >
          <HelpCircle size={16} strokeWidth={2} />
          {!collapsed && <span>Help & docs</span>}
        </a>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] text-base-content/70 hover:text-base-content hover:bg-base-200/60"
        >
          <LogOut size={16} strokeWidth={2} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
