"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "pitwall-dark";

/**
 * Swaps between DaisyUI's `light` theme and the custom `pitwall-dark`
 * (racing palette). Persists choice in localStorage; the inline bootstrap
 * in layout.tsx applies the saved theme before first paint to avoid FOUC.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Re-read the value the inline bootstrap set on <html>.
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "pitwall-dark") setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "pitwall-dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("pitwall-theme", next);
    } catch {}
  };

  const isDark = theme === "pitwall-dark";

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost btn-sm gap-2"
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label="Toggle color theme"
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
      <span className="text-xs font-medium">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
