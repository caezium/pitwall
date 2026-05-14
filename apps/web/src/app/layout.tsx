import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./client-layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pitwall",
  description: "Personal finance command center",
};

/* Inline bootstrap so the saved theme is applied before first paint —
   prevents a light→dark flash for users who chose pitwall-dark. */
/* Whitelist must match THEMES in theme-toggle.tsx and the `themes:` line
   in globals.css. Default is "light" — OS preference is ignored on purpose. */
const themeBootstrap = `
(function () {
  var allowed = ["light","business"];
  try {
    var t = localStorage.getItem("pitwall-theme");
    if (allowed.indexOf(t) === -1) t = "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (_) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen antialiased bg-base-100 text-base-content">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
