import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./client-layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pitwall",
  description: "Personal finance command center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }} className="min-h-screen antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
