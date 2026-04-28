"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "◎" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/expenses", label: "Transactions", icon: "↔" },
      { href: "/quick-entry", label: "Quick Entry", icon: "⚡" },
      { href: "/karting", label: "Karting", icon: "🏁" },
      { href: "/budgets", label: "Budgets", icon: "◐" },
      { href: "/recurring", label: "Recurring", icon: "↻" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ai-costs", label: "Usage", icon: "⬡" },
      { href: "/subscriptions", label: "Subscriptions", icon: "∞" },
    ],
  },
  {
    label: "Invest",
    items: [
      { href: "/investments", label: "Portfolio", icon: "△" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/import", label: "Import", icon: "↓" },
      { href: "/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );
  const pathname = usePathname();

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
          {/* Sidebar */}
          <aside
            className="w-60 flex flex-col border-r"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
          >
            {/* Logo */}
            <div className="px-5 pt-6 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  P
                </div>
                <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Pitwall
                </span>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.label} className="mb-4">
                  <p
                    className="px-3 mb-1 text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium"
                        style={{
                          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                          background: isActive ? "var(--bg-card)" : "transparent",
                        }}
                      >
                        <span className="text-base w-5 text-center">{item.icon}</span>
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Sign out
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
