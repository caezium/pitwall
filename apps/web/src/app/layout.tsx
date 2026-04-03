import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitwall",
  description: "Personal finance command center",
};

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/expenses", label: "Expenses" },
  { href: "/karting", label: "Karting" },
  { href: "/ai-costs", label: "AI Costs" },
  { href: "/investments", label: "Investments" },
  { href: "/budgets", label: "Budgets" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <Providers>
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
        </Providers>
      </body>
    </html>
  );
}
