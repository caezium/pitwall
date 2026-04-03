"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/expenses", label: "Expenses" },
  { href: "/karting", label: "Karting" },
  { href: "/ai-costs", label: "AI Costs" },
  { href: "/investments", label: "Investments" },
  { href: "/budgets", label: "Budgets" },
  { href: "/settings", label: "Settings" },
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

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <div className="flex">
          <aside className="w-56 border-r border-zinc-800 min-h-screen p-4 flex flex-col gap-1">
            <h1 className="text-xl font-bold mb-6 px-3">Pitwall</h1>
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
