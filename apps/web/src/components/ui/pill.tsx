import type { ReactNode } from "react";

export type PillTone = "pos" | "neg" | "warn" | "info" | "mute";

export function Pill({ tone = "mute", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
